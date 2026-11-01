import { useContext } from "react";
import { UserContext } from "../context/UserContext";
import { getRank, getRespectsForNextLevel, getRankProgress } from "../utils/rankSystem";

const Identity = () => {

  const { user, posts } = useContext(UserContext);

  const myPosts = (posts || []).filter(
    (p) => p.creatorId === user?.id
  );

  const totalRespects = myPosts.reduce(
    (sum, p) => sum + (p.totalRespects || 0),
    0
  );
  const rank = getRank(totalRespects);
  const level = rank?.level ?? 1;
  const { nextLevel: nextTarget } = getRespectsForNextLevel(totalRespects);
  const progress = getRankProgress(totalRespects);

  return (
    <div className="identity-page">

      {/* Basic Info */}
      <h2 className="identity-name">
        {user.name}
      </h2>

      <p className="identity-joined">
        Joined Since: {user.joined}
      </p>

      <h3>{rank?.title || rank}</h3>

      {/* Stats */}
      <div className="identity-stats">

        <h3>{totalRespects} Total Respects</h3>
        <div className="rank-box">
          <p>Level {level}</p>
          <p>{rank?.title}</p>
        </div>

        <div>
          <strong>{myPosts.length}</strong>
          <p>Posts</p>
        </div>

      </div>

      {/* My Content */}
      <div className="identity-posts">

        {myPosts.map((post) => (
          <video
            key={post.id}
            src={post.videoUrl}
            className="identity-video"
          />
        ))}

      </div>
      <div className="rank-section">
        <div className="rank-row">
          <span className="rank-name">{rank?.title}</span>

          {nextTarget && (
            <span className="rank-target">
              {totalRespects} / {nextTarget}
            </span>
          )}
        </div>

        {nextTarget && (
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div style={{ paddingBottom: "80px" }}></div>
      </div>

    </div>
  );
};

export default Identity;