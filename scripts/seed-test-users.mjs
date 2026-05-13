import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan variables de entorno requeridas.');
  console.error('Necesitas VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const TEST_USERS = [
  {
    email: process.env.TEST_ADMIN_EMAIL || 'admin.test@ccmgc.es',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin12345!',
    fullName: 'Admin Pruebas',
    role: 'admin',
    department: 'Sistemas',
  },
  {
    email: process.env.TEST_EDITOR_EMAIL || 'editor.test@ccmgc.es',
    password: process.env.TEST_EDITOR_PASSWORD || 'Editor12345!',
    fullName: 'Editor Pruebas',
    role: 'editor',
    department: 'Operaciones',
  },
  {
    email: process.env.TEST_VIEWER_EMAIL || 'viewer.test@ccmgc.es',
    password: process.env.TEST_VIEWER_PASSWORD || 'Viewer12345!',
    fullName: 'Viewer Pruebas',
    role: 'viewer',
    department: 'Lectura',
  },
  {
    email: process.env.TEST_OPERATOR_EMAIL || 'operator.test@ccmgc.es',
    password: process.env.TEST_OPERATOR_PASSWORD || 'Operator12345!',
    fullName: 'Operador Pruebas',
    role: 'operator',
    department: 'Centro de Control',
  },
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function createOrUpdateAuthUser(user) {
  const existing = await findUserByEmail(user.email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
      },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error(`No se pudo crear el usuario ${user.email}`);
  return data.user;
}

async function upsertProfile(authUserId, user) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: authUserId,
      full_name: user.fullName,
      role: user.role,
      department: user.department,
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}

async function main() {
  console.log('Creando/actualizando usuarios de prueba...');

  for (const user of TEST_USERS) {
    const authUser = await createOrUpdateAuthUser(user);
    await upsertProfile(authUser.id, user);
    console.log(`OK ${user.role}: ${user.email}`);
  }

  console.log('\nUsuarios de prueba listos:');
  for (const user of TEST_USERS) {
    console.log(`- ${user.role}: ${user.email} / ${user.password}`);
  }
}

main().catch((error) => {
  console.error('\nError creando usuarios de prueba:');
  console.error(error.message ?? error);
  process.exit(1);
});
