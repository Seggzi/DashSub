export async function getMonnifyToken() {
  const auth = Buffer.from(`${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`).toString('base64');

  const res = await fetch('https://api.monnify.com/api/v1/disbursements/login', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const data = await res.json();
  if (!data.requestSuccessful) throw new Error(data.responseMessage);

  return data.responseBody.accessToken;
}