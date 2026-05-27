// api/health.js – simple test endpoint
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    env: {
      WEBHOOK_URL_exists: !!process.env.WEBHOOK_URL
    }
  });
};
