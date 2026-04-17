require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const exists = await User.findOne({ email: 'manager@manager.com' });
  if(!exists) {
    await User.create({ name: 'Manager', email: 'manager@gmail.com', password: 'password123', role: 'manager' });
    console.log('Manager admin created: manager@admin.com / password123');
  } else {
    console.log('Manager admin already exists');
  }
  process.exit(0);
}).catch(e => console.error(e));
