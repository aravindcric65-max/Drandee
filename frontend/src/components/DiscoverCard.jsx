import { useContext } from "react";
import { UserContext } from "../context/UserContext";
import { getRank } from "../utils/rankSystem";

const DiscoverCard = ({ post }) => {
    const { posts } = useContext(UserContext);

    //creator total respects
    const creatorPosts = posts.filter(
        (p) => p.creatorId === post.creatorId
    );

    const totalRespects = creatorPosts.reduce(
        (sum, p) => sum + p.totalRespects,
        0
    );

    const rank = getRank(totalRespects);

    return (
        <div className="discover-card">
            <video 
                src={post.videoUrl}
            />

            <div className="discover-info">
                <span>{post.creatorName}</span>
                <span>{rank}</span>
            </div>

            <div className="discover-respects">
                {post.totalRespects} Respects
            </div>
        </div>
    );
};

export default DiscoverCard;