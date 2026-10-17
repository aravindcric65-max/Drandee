import React from "react";
import { motion } from "framer-motion";

export default function PortfolioCard({ data, onShare}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-[@0A0A0A] text-white p-6 rounded-2xl shadow-xl max-w-sm mx-auto"
        >
            
            <h2 className="text-center text-lg font-bold mb-4">
                DRANDEE Spotlight
            </h2>

            <div className="flex flex-col items-center">
                <img 
                    src={data.profile}
                    alt="profile"
                    className="w-20 h-20 rounded-full border-2 border-yellow-400 object-cover"
                    
                />

                <h3 className="mt-2 text-xl font-semibold">{data.name}</h3>
                <p className="text-sm text-gray-400">{data.location}</p>
            </div>

            <div className="mt-4">
                <img 
                    src={data.thumbnail}
                    alt="video"
                    className="rounded-xl w-full h-40 object-cover"
                />
            </div>

            <motion.p 
                initial={{ scale: 0}}
                animate={{ scale: 1}}
                transition={{ delay: 0.3}}
                className="text-lg"
            >
                <p>{data.votes} Votes</p>
                <p>{data.watch} % Watch</p>
                <p>Rank #{data.rank}</p>
            </motion.p>

            <div className="flex gab-3 mt-6">
                <button onClick={onShare} className="bg-yellow-400 text-black px-4 py-2 rounded-xl w-full">
                    Share
                </button>
                <button className="border border-white px-4 py-2 rounded-xl w-full">
                    Profile
                </button>
            </div>
        </motion.div>
    );
}