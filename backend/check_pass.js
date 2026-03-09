const bcrypt = require('bcryptjs');
const password = 'Malvinas1982!';
const hash1 = '$2b$10$EpRnTzVlqHNP0.fKb.U9H.micro/cf'; // admin
const hash2 = '$2b$10$cjo4lITr6BU9dF3WnVxmOeJPJ1GDopEjmQ7bDv5e8cukW557JugH/.'; // rmarketing

console.log('Testing admin hash:', bcrypt.compareSync(password, hash1));
console.log('Testing rmarketing hash:', bcrypt.compareSync(password, hash2));
