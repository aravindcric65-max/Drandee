const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const samplePosts = [
  {
    type: 'video',
    caption: 'Latest AI tools you need to try! 🚀 #AI #Technology #Tech',
    tags: ['AI', 'Technology', 'Tech'],
    video_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    image_url: null,
    stats: { respects: 1234, comments: 56, shares: 12, saves: 89, views: 50000 }
  },
  {
    type: 'photo',
    caption: 'Beautiful sunset in Goa 🌅 #Travel #Goa #Sunset',
    tags: ['Travel', 'Goa', 'Sunset'],
    video_url: null,
    image_url: 'https://picsum.photos/400/600?random=1',
    stats: { respects: 890, comments: 34, shares: 8, saves: 45, views: 15000 }
  },
  {
    type: 'video',
    caption: '5-minute morning workout routine 💪 #Fitness #Workout #Health',
    tags: ['Fitness', 'Workout', 'Health'],
    video_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    image_url: null,
    stats: { respects: 2345, comments: 123, shares: 45, saves: 234, views: 120000 }
  },
  {
    type: 'carousel',
    caption: 'Best street food in Chennai! 🍕🍔 #Food #Chennai #StreetFood',
    tags: ['Food', 'Chennai', 'StreetFood'],
    video_url: null,
    image_url: 'https://picsum.photos/400/600?random=2',
    stats: { respects: 567, comments: 28, shares: 15, saves: 67, views: 8000 }
  },
  {
    type: 'text',
    caption: 'Success is not final, failure is not fatal: It is the courage to continue that counts.\n\nKeep pushing forward! 💯\n\n#Motivation #Success #Inspiration #Mindset',
    tags: ['Motivation', 'Success', 'Inspiration', 'Mindset'],
    video_url: null,
    image_url: null,
    stats: { respects: 3456, comments: 234, shares: 89, saves: 456, views: 200000 }
  }
];

const createSamplePosts = async () => {
  try {
    console.log('🔍 Connecting to database...\n');
    const client = await pool.connect();
    
    // Get a user ID (first user or create one)
    const userQuery = 'SELECT id, username, name FROM users LIMIT 1;';
    const userResult = await client.query(userQuery);
    
    let user;
    if (userResult.rows.length === 0) {
      console.log('⚠️  No users found. You must register at least one user first.');
      client.release();
      process.exit(1);
    } else {
      user = userResult.rows[0];
      console.log(`✅ Using user: ${user.username} (${user.id})`);
    }

    console.log('\\n🧹 Cleaning up old posts...\\n');
    await client.query('TRUNCATE TABLE posts CASCADE;');
    
    console.log('\n📝 Creating 5 sample posts...\n');
    
    for (const post of samplePosts) {
      const insertQuery = `
        INSERT INTO posts (user_id, creator_id, creator_name, type, caption, tags, video_url, image_url, total_respects, comment_count, share_count, save_count, watch_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id;
      `;
      
      await client.query(insertQuery, [
        user.id,
        user.id,
        user.name || user.username,
        post.type,
        post.caption,
        post.tags,
        post.video_url,
        post.image_url,
        post.stats.respects,
        post.stats.comments,
        post.stats.shares,
        post.stats.saves,
        post.stats.views
      ]);
      
      console.log(`✅ Created ${post.type} post: ${post.caption.substring(0, 40)}...`);
    }
    
    client.release();
    console.log('\n✅ Sample posts created successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createSamplePosts();
