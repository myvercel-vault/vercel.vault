# frozen_string_literal: true
require 'webrick'
require 'sqlite3'
require 'openssl'
require 'json'
require 'base64'
require 'securerandom'
require 'fileutils'
require 'uri'
require 'thread'

ROOT = File.expand_path('..', __dir__)
DIST = File.join(ROOT, 'dist')
DATA_DIR = File.expand_path(ENV.fetch('VAULT_LOCAL_DATA', File.join(__dir__, 'data')))
FileUtils.mkdir_p(DATA_DIR, mode: 0o700)
File.chmod(0o700, DATA_DIR)
PEPPER_FILE = File.join(DATA_DIR, '.pepper')
if !ENV['VAULT_PEPPER'] && !File.exist?(PEPPER_FILE)
  begin
    File.open(PEPPER_FILE, File::WRONLY | File::CREAT | File::EXCL, 0o600) { |f| f.write(SecureRandom.hex(32)) }
  rescue Errno::EEXIST
    # A concurrent local process initialized the file.
  end
end
PEPPER = ENV['VAULT_PEPPER'] || File.read(PEPPER_FILE).strip
abort('VAULT_PEPPER must have at least 32 characters.') if PEPPER.length < 32
DB = SQLite3::Database.new(File.join(DATA_DIR, 'vault.sqlite3'))
DB.results_as_hash = true
DB.busy_timeout = 2500
DB.execute('PRAGMA foreign_keys = ON')
unless DB.get_first_value("SELECT name FROM sqlite_master WHERE name = 'accounts'")
  DB.execute_batch(File.read(File.join(ROOT, 'worker/migrations/0001_vault.sql')))
end
MUTEX = Mutex.new
SESSION_MS = 2 * 60 * 60 * 1000
BUCKET_MS = 10 * 60 * 1000
MAX_BODY = 206_000
MIME = {'.html'=>'text/html; charset=utf-8','.js'=>'text/javascript; charset=utf-8','.css'=>'text/css; charset=utf-8','.webp'=>'image/webp','.png'=>'image/png','.woff2'=>'font/woff2','.wasm'=>'application/wasm','.txt'=>'text/plain; charset=utf-8'}.freeze
CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'".freeze

class APIError < StandardError
  attr_reader :status
  def initialize(status, message)
    super(message)
    @status = status
  end
end

def problem(status, message)
  raise APIError.new(status, message)
end

def json(res, value, status = 200)
  res.status = status
  res['Content-Type'] = 'application/json; charset=utf-8'
  res['Cache-Control'] = 'no-store'
  res.body = JSON.generate(value)
end

def base64(value)
  Base64.urlsafe_encode64(value, padding: false)
end

def valid_b64(value, len)
  value.is_a?(String) && value.length == len && value.match?(/\A[A-Za-z0-9_-]+\z/)
end

def valid_email(value)
  value.is_a?(String) && value.length.between?(4, 254) && value.match?(/\A[a-z0-9.!\x23$%&'*+\/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+\z/)
end

def valid_envelope(body)
  data = body['data']
  valid_b64(body['iv'], 16) && data.is_a?(String) && data.length.between?(22, 200_022) && data.length % 4 != 1 && data.match?(/\A[A-Za-z0-9_-]+\z/)
end

def read_json(req)
  problem(415, 'Send the body as application/json.') unless req['Content-Type'].to_s.match?(/\Aapplication\/json\s*(?:;|\z)/i)
  problem(413, 'The encrypted request is too large.') if req['Content-Length'].to_i > MAX_BODY
  text = +''
  req.body do |part|
    problem(413, 'The encrypted request is too large.') if text.bytesize + part.bytesize > MAX_BODY
    text << part
  end
  object = JSON.parse(text)
  problem(400, 'The request body is not valid.') unless object.is_a?(Hash)
  object
rescue JSON::ParserError
  problem(400, 'The request body is not valid.')
end

def hmac(purpose, *parts)
  OpenSSL::HMAC.digest('SHA256', PEPPER, ['my-vercel-vault/v1',purpose,*parts].join("\0"))
end

def digest(token)
  base64(OpenSSL::Digest::SHA256.digest(token))
end

def token_for(email, now)
  token = base64(SecureRandom.random_bytes(32))
  DB.execute('INSERT INTO sessions (token_hash, email, expires) VALUES (?, ?, ?)', [digest(token),email,now + SESSION_MS])
  token
end

def rate(kind, value, maximum, now)
  bucket = now / BUCKET_MS
  scope = base64(hmac('limit',kind,value))
  row = DB.get_first_row('INSERT INTO rate_limits (scope, bucket, hits) VALUES (?, ?, 1) ON CONFLICT (scope, bucket) DO UPDATE SET hits = MIN(hits + 1, 1000000) RETURNING hits', [scope,bucket])
  problem(429, 'Too many requests. Wait a few minutes and try again.') if row['hits'] > maximum
end

def origin_ok?(req)
  return false if %w[cross-site same-site].include?(req['Sec-Fetch-Site'])
  return true unless req['Origin']
  uri = URI.parse(req['Origin'])
  host = req['Host'].to_s
  authority = uri.port == uri.default_port ? uri.host : "#{uri.host}:#{uri.port}"
  %w[http https].include?(uri.scheme) && host == authority
rescue URI::Error
  false
end

def handle_api(req, res)
  problem(403, 'Open the vault on its own website.') unless origin_ok?(req)
  path = req.path
  method = req.request_method
  now = (Time.now.to_f * 1000).to_i
  case path
  when '/api/health'
    if method == 'GET'
      DB.get_first_row('SELECT 1 FROM accounts LIMIT 1')
      return json(res, {ok:true})
    end
  when '/api/salt', '/api/login', '/api/register'
    if method == 'POST'
      action = path.delete_prefix('/api/')
      rate("#{action}/ip", req.peeraddr[3], action == 'register' ? 12 : 120, now)
      body = read_json(req)
      email = body['email']
      problem(400, 'Enter a valid email address.') unless valid_email(email)
      row = DB.get_first_row('SELECT * FROM accounts WHERE email = ?', email)
      return json(res, {salt:row ? row['salt'] : base64(hmac('placeholder-salt',email).byteslice(0,16))}) if action == 'salt'
      proof = body['proof']
      problem(400, 'Invalid authentication data.') unless valid_b64(proof, 43)
      rate("#{action}/account", email, action == 'register' ? 5 : 12, now)
      if action == 'register'
        problem(403, 'New account registration is currently closed.') unless ENV.fetch('REGISTRATION_OPEN','true') == 'true'
        salt = body['salt']
        problem(400, 'Invalid encrypted vault.') unless valid_b64(salt,22) && valid_envelope(body)
        problem(409, 'Could not create that account. If this is your email, try unlocking your vault.') if row
        token = nil
        DB.transaction do
          DB.execute('INSERT INTO accounts (email,salt,verifier,iv,ciphertext,updated) VALUES (?,?,?,?,?,?)', [email,salt,base64(hmac('verifier',email,salt,proof)),body['iv'],body['data'],now])
          token = token_for(email,now)
        end
        return json(res, {token:token,revision:1,updated:now},201)
      end
      match = OpenSSL.fixed_length_secure_compare(base64(hmac('verifier',email,row ? row['salt'] : 'A' * 22,proof)), row ? row['verifier'] : 'A' * 43)
      problem(401, 'The email or master passphrase is incorrect.') unless row && match
      return json(res, {token:token_for(email,now),revision:row['revision'],iv:row['iv'],data:row['ciphertext'],updated:row['updated']})
    end
  when '/api/vault', '/api/logout', '/api/account'
    auth = req['Authorization'].to_s
    problem(401, 'Your vault session has ended.') unless auth.match?(/\ABearer [A-Za-z0-9_-]{43}\z/)
    hash = digest(auth.delete_prefix('Bearer '))
    session = DB.get_first_row('SELECT email FROM sessions WHERE token_hash = ? AND expires > ?', [hash,now])
    problem(401, 'Your vault session has ended.') unless session
    email = session['email']
    if path == '/api/logout' && method == 'POST'
      DB.execute('DELETE FROM sessions WHERE token_hash = ?', hash)
      return json(res, {ok:true})
    end
    if path == '/api/vault' && method == 'PUT'
      rate('write/account',email,180,now)
      body = read_json(req)
      rev = body['revision']
      problem(400, 'Invalid encrypted vault.') unless valid_envelope(body) && rev.is_a?(Integer) && rev.between?(1, (2 ** 53) - 1)
      DB.execute('UPDATE accounts SET iv=?,ciphertext=?,revision=revision+1,updated=? WHERE email=? AND revision=?', [body['iv'],body['data'],now,email,rev])
      problem(409, 'Your vault changed on another device. Lock and unlock again before saving. Your changes were not saved.') if DB.changes.zero?
      return json(res, {revision:rev + 1,updated:now})
    end
    if path == '/api/account' && method == 'DELETE'
      rate('delete/account',email,5,now)
      proof = read_json(req)['proof']
      row = DB.get_first_row('SELECT salt,verifier FROM accounts WHERE email = ?',email)
      problem(401, 'The master passphrase is incorrect.') unless row && valid_b64(proof,43) && OpenSSL.fixed_length_secure_compare(base64(hmac('verifier',email,row['salt'],proof)),row['verifier'])
      DB.execute('DELETE FROM accounts WHERE email = ?',email)
      return json(res, {ok:true})
    end
  end
  problem(404, 'This API route does not exist.')
rescue APIError => e
  res['Retry-After'] = '600' if e.status == 429
  json(res, {error:e.message}, e.status)
end

class VaultServlet < WEBrick::HTTPServlet::AbstractServlet
  def service(req,res)
    res['X-Content-Type-Options'] = 'nosniff'
    res['Referrer-Policy'] = 'no-referrer'
    res['X-Frame-Options'] = 'DENY'
    if req.path == '/api' || req.path.start_with?('/api/')
      MUTEX.synchronize { handle_api(req,res) }
      return
    end
    return json(res, {error:'Not found.'},404) unless %w[GET HEAD].include?(req.request_method)
    res['Content-Security-Policy'] = CSP
    asset = File.expand_path(req.path.delete_prefix('/'), DIST)
    if (req.path == '/robots.txt' || req.path.match?(%r{\A/(assets|media)/[a-zA-Z0-9_.@/-]+\z})) && asset.start_with?(DIST + '/') && File.file?(asset) && MIME.key?(File.extname(asset))
      res['Content-Type'] = MIME.fetch(File.extname(asset))
      res['Cache-Control'] = req.path.start_with?('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
      res.body = File.binread(asset)
    elsif req.path == '/' || %w[/login /signup /vault /demo /guide /privacy /terms].include?(req.path)
      res['Content-Type'] = MIME.fetch('.html')
      res['Cache-Control'] = 'no-store'
      res.body = File.binread(File.join(DIST,'index.html'))
    else
      json(res,{error:'Not found.'},404)
    end
  rescue StandardError => e
    warn "Vault server: #{e.class} at #{req.request_method} #{req.path}"
    json(res,{error:'The vault service could not complete the request.'},500)
  end
end

abort('Build the Vue frontend first: npm ci && npm run build') unless File.file?(File.join(DIST,'index.html')) || ENV['API_ONLY'] == 'true'
port = Integer(ENV.fetch('PORT','3000'))
server = WEBrick::HTTPServer.new(Port:port, BindAddress:ENV.fetch('BIND','127.0.0.1'), AccessLog:[], Logger:WEBrick::Log.new($stderr,WEBrick::Log::WARN), RequestTimeout:15, MaxClients:24)
server.mount '/', VaultServlet
%w[INT TERM].each { |sig| trap(sig) { server.shutdown } }
puts "My Vercel Vault is listening on port #{port}"
STDOUT.flush
server.start
