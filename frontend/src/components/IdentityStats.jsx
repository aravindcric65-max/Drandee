import { formatNumber } from "../utils/formatNumber";

const IdentityStats = ({ postsCount, respects, joined }) => {
    return (
        <div className="identity-stats">
            <div className="stat">
                <div className="stat-number">
                    {formatNumber(postsCount)}
                </div>
                <div className="stat-label">
                    Posts
                </div>
            </div>
            <div className="stat">
                <div className="stat-number">
                    {formatNumber(respects)}
                </div>
                <div className="stat-label">
                    Respects
                </div>

            </div>
            <div className="stat">
                <div className="stat-number">
                    {joined}
                </div>
                <div className="stat-label">
                    Joined
                </div>
            </div>
        </div>
    );
};

export default IdentityStats;