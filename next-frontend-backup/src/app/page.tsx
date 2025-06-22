export default function Home() {
  return (
    <html>
      <body>
        <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
          <h1 style={{ color: '#2563eb', fontSize: '48px', marginBottom: '20px' }}>
            TAAXDOG
          </h1>
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '30px' }}>
            Australian Tax Management Platform
          </p>
          <div style={{ marginTop: '40px' }}>
            <a 
              href="/login" 
              style={{ 
                backgroundColor: '#2563eb', 
                color: 'white', 
                padding: '12px 24px', 
                textDecoration: 'none', 
                borderRadius: '6px',
                fontSize: '16px'
              }}
            >
              Get Started
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}