import React from "react";

export default function ProfilePage() {
    return  (
        <div className="bg-black text-white min-h-screen p-6">

            <div className="text-center">
                <img 
                    src="/profile.jpg"
                    className="w-24 h-24 rounded-full mx-auto"
                />

                <h1 className="text-xl mt-2">Aravindan</h1>

                <p className="text-gray-400">TamilNadu</p>
            </div>

            <div className="mt-6">
                <h2 className="text-lg mb-2">Achievements</h2>
                <div className="flex gab-2 flex-wrap">
                    <span className="bg-yellow-400 text-black px-3 py-1 rounded">
                        Local Winner
                    </span>

                    <span className="bg-gray-700 px-3 py-1 rounded">
                        State Top 10
                    </span>

                </div>
            </div>

            <div className="mt-6">
                <h2 className="text-lg mb-2">Videos</h2>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-800 h-32 rounded"></div>
                    <div className="bg-gray-800 h-32 rounded"></div>
                </div>
            </div>
        </div>
    );
}