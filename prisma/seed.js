/* eslint-disable no-console */
const { PrismaClient, UserType, UserStatus, AccessRequestStatus } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE || '9999999999';
  const adminName = process.env.SEED_ADMIN_NAME || 'System Admin';
  const adminPasskey = process.env.SEED_ADMIN_PASSKEY
    ? parseInt(process.env.SEED_ADMIN_PASSKEY, 10)
    : null;

  const adminUser = await prisma.user.upsert({
    where: { contactNumber: adminPhone },
    update: {
      name: adminName,
      userType: UserType.admin,
      status: UserStatus.active,
      isActive: true,
      otpVerifiedAt: new Date(),
    },
    create: {
      name: adminName,
      contactNumber: adminPhone,
      userType: UserType.admin,
      status: UserStatus.active,
      isActive: true,
      passkey: adminPasskey ?? undefined,
    },
  });

  console.log('Seeded admin user with ID:', adminUser.id.toString());

  if (process.env.SEED_SAMPLE_ACCESS_REQUEST === 'true') {
    const sample = await prisma.accessRequest.upsert({
      where: { phone: adminPhone },
      update: {},
      create: {
        name: adminName,
        phone: adminPhone,
        selfieUrl: '/uploads/access_requests/sample.jpg',
        status: AccessRequestStatus.pending,
      },
    });
    console.log('Seeded sample access request:', sample.id);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('Prisma seed failed', err);
    await prisma.$disconnect();
    process.exit(1);
  });

