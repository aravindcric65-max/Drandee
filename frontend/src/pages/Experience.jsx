import { useContext } from "react";
import { UserContext } from "../context/UserContext";
import { getRank } from "../utils/rankSystem";

const Experience = () => {

  const { user, posts } = useContext(UserContext);

  // trending top respects
  const trending = [...posts].sort((a, b) => b.totalRespects - a.totalRespects).slice(0, 5);

  // your stats
  const myPosts = posts.filter(p => p.creatorId === user.id);

  const myRespects = myPosts.reduce(
    (sum, p) => sum + p.totalRespects,
    0
  );

  const myRank = getRank(myRespects);

  // simple reccomendation
  const recommended = posts.filter(p => p.creatorId !== user.id).slice(0, 5);

  return (
    <div className="experience-page">
      <h2>Experience</h2>

      <div className="exp-section">
          <h3>Your Growth</h3>

          <div className="exp-card">
            <span>Rank</span>
            <strong>{myRank}</strong>
          </div>

          <div className="exp-card">
            <span>Total Respects</span>
            <strong>{myRespects}</strong>
          </div>
      </div>

      <div className="exp-section">
        <h3>Trending creators</h3>

        {trending.map((post) => {
          const rank = getRank(post.totalRespects);

          return (
            <div key={post.id} className="exp-list">
              <span>{post.creatorName}</span>
              <span>{rank}</span>
            </div>
          );
        })}
      </div>

      <div className="exp-section">
        <h3>Discover More</h3>

        {recommended.map((post) => {
          const rank = getRank(post.totalRespects);

          return (
            <div key={post.id} className="exp-list">
              <span>{post.creatorName}</span>
              <span>{rank}</span>
            </div>
          );
        })}
      </div>

      <div style={{ paddingBottom: "80px" }}></div>
    </div>
  );
};

export default Experience;