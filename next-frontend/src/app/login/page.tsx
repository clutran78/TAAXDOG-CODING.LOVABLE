export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to TAAXDOG
          </h2>
        </div>
        <div className="mt-8 space-y-6">
          <div>
            <label className="sr-only">Email address</label>
            <input 
              type="email" 
              className="relative block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Email address"
            />
          </div>
          <div>
            <label className="sr-only">Password</label>
            <input 
              type="password" 
              className="relative block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Password"
            />
          </div>
          <div>
            <button className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 