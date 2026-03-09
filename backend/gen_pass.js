const bcrypt = require('bcryptjs');
const password = 'Malvinas1982!';

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('New hash for Malvinas1982!:', hash);
