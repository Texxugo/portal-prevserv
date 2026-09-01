const fs = require('fs')
function edit(p, fn) {
  const bruto = fs.readFileSync(p, 'utf8')
  const crlf = bruto.includes('\r\n')
  let s = bruto.replace(/\r\n/g, '\n')
  const antes = s
  s = fn(s)
  if (s === antes) { console.log(`AVISO: nada mudou em ${p}`); return }
  fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s)
  console.log(`ok ${p}`)
}
module.exports = { edit }
