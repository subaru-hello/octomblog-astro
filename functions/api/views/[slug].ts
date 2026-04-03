interface Env {
  VIEWS: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async ({ params, request, env }) => {
  const slug = params.slug as string;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (!env.VIEWS) {
    // KV未設定時のフォールバック（ローカル開発用）
    return new Response(JSON.stringify({ views: 0 }), { headers });
  }

  const current = Number((await env.VIEWS.get(slug)) ?? 0);

  if (request.method === 'POST') {
    const next = current + 1;
    await env.VIEWS.put(slug, String(next));
    return new Response(JSON.stringify({ views: next }), { headers });
  }

  return new Response(JSON.stringify({ views: current }), { headers });
};
