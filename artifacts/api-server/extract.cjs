const yaml = require('yaml');
const fs = require('fs');
const f = process.argv[2];
const field = process.argv[3];
const doc = yaml.parse(fs.readFileSync(f, 'utf8'));
const v = doc[field];
if (v === undefined) process.exit(0);
process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v));
