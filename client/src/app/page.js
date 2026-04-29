import ResonateApp from "../components/ResonateApp";

export const metadata = {
  title: "Resonate",
  description: "Real-time audio synchronization across devices.",
};

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-white p-8">
            <div className="max-w-md w-full flex flex-col items-center">
                
                {/* Static Server-Rendered Branding */}
                <div className="text-center mb-2">
                    <h1 className="text-5xl font-bold text-blue-600 tracking-widest mb-2">
                        RESONATE
                    </h1>
                </div>

                {/* Highly Interactive Client Shell */}
                <ResonateApp />

            </div>
        </main>
    );
}