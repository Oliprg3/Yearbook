const createAdminIfNotExists = async () => {
    try {
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        const adminExists = await User.findOne({ email: 'admin@newayacademy.com' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                name: 'Administrator',
                email: 'admin@newayacademy.com',
                password: hashedPassword,
                isAdmin: true,
                year: 2027
            });
            console.log('✅ Admin user created successfully');
        } else {
            console.log('👑 Admin user already exists');
        }
    } catch (err) {
        console.error('Error creating admin:', err);
    }
};

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
      console.log('✅ MongoDB connected successfully');
      await createAdminIfNotExists();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));
