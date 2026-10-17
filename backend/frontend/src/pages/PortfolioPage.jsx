import React, { useState, useEffect } from "react";
import PortfolioCard from "../components/PortfolioCard";
import { exportCard } from "../utils/exportCard";

export default function PortfolioPage() {
    const [data, setData] = useState(null);

    useEffect(() => {
        fetch("/api/portfolio/1").then((res) => res.json()).then((res) => setData(res));
    },  []);

    const handleShare = async () => {
        if (navigator.share) {
            await navigator.share({
                title: "I Won on DRANDEE",
                text: "Real talent wins here",
                url: window.location.href
            });
        }
    };

    if (!data) return <p className="text-center mt-10">Loading...</p>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <PortfolioCard data={data} onShare={handleShare} />

            <button onClick={() => exportCard("portfolio-card")} className="mt-4 bg-white text-black px-4 py-2 rounded-xl">
                Download
            </button>
        </div>

        

    );
}