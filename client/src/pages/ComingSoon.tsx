export default function ComingSoon() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">
          Coming Soon ⚽️
        </h1>
        <p className="text-xl text-gray-400">
          This feature is under development
        </p>
        <button
          onClick={() => window.history.back()}
          className="mt-8 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

