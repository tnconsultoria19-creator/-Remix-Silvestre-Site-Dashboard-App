interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const { results: users } = await env.DB.prepare('SELECT * FROM users').all();
  
  const agents = users.map((u: any) => ({
    name: u.name,
    email: u.email,
    isAdmin: u.role === 'admin' || u.role === 'superadmin',
    isApproved: true, // simplified for now
    didPassQuiz: true,
    isFrozen: false,
    avatarUrl: u.avatar_url || `https://ui-avatars.com/api/?name=${u.name}`,
    joinedDate: u.created_at,
    country: u.country || 'USA',
    completedCount: 0,
    rating: 5.0,
    earnings: 0,
    metrics: { accuracy: 100, speed: "Fast", reliability: 100 },
    certifications: []
  }));
  
  return new Response(JSON.stringify(agents), {
    headers: { 'Content-Type': 'application/json' }
  });
};
