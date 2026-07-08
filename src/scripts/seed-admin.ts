import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { UserSchema } from '../schemas/user.schema';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/centro-db';
const email = process.env.ADMIN_EMAIL || 'admin@centro.local';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const name = process.env.ADMIN_NAME || 'Amministratore';

async function seedAdmin() {
  await mongoose.connect(mongoUri);

  const UserModel = mongoose.model('User', UserSchema);
  const existing = await UserModel.findOne({ email }).exec();
  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing) {
    existing.set({
      name,
      password: hashedPassword,
      role: 'admin',
    });
    await existing.save();
    console.log(`Admin aggiornato: ${email}`);
  } else {
    await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
    });
    console.log(`Admin creato: ${email}`);
  }

  await mongoose.disconnect();
}

seedAdmin().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
