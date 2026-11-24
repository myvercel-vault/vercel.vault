;; This module handles character-class checks and unbiased index selection.
;; Cryptographically secure random words come from the browser, not from WASM.
(module
  (func (export "classify") (param $code i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $code) (i32.const 97)) (i32.le_u (local.get $code) (i32.const 122))) (then (return (i32.const 1))))
    (if (i32.and (i32.ge_u (local.get $code) (i32.const 65)) (i32.le_u (local.get $code) (i32.const 90))) (then (return (i32.const 2))))
    (if (i32.and (i32.ge_u (local.get $code) (i32.const 48)) (i32.le_u (local.get $code) (i32.const 57))) (then (return (i32.const 4))))
    (i32.const 8))
  (func (export "sample_index") (param $random i32) (param $length i32) (result i32)
    (local $r i64) (local $n i64) (local $space i64)
    (if (i32.eqz (local.get $length)) (then (return (i32.const -1))))
    (local.set $r (i64.extend_i32_u (local.get $random)))
    (local.set $n (i64.extend_i32_u (local.get $length)))
    (local.set $space (i64.const 4294967296))
    (if (i64.ge_u (local.get $r) (i64.sub (local.get $space) (i64.rem_u (local.get $space) (local.get $n)))) (then (return (i32.const -1))))
    (i32.wrap_i64 (i64.rem_u (local.get $r) (local.get $n))))
)
