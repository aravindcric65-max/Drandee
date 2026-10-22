const BASE_URL =
  "http://localhost:5000";

const PASSWORD =
  "TestPass123!";

const USER_COUNT = 20;
const FEED_REQUESTS_PER_USER = 4;

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

async function request(
  path,
  options = {}
) {
  const response = await fetch(
    `${BASE_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
    }
  );

  const body =
    await response.json();

  return {
    status: response.status,
    body,
  };
}

async function registerUser(
  index
) {
  const timestamp = Date.now();

  const user = {
    name: `AB Test User ${index}`,
    email:
      `abtest_${timestamp}_${index}@gmail.com`,
    password: PASSWORD,
  };

  const result = await request(
    "/api/register",
    {
      method: "POST",
      body: JSON.stringify(user),
    }
  );

  if (
    !result.body.success
  ) {
    throw new Error(
      `Registration failed for ${user.email}: ${
        result.body.error
      }`
    );
  }

  return {
    id: result.body.user.id,
    email: user.email,
    token: result.body.token,
  };
}

async function getFeed(
  token
) {
  return request(
    "/api/feed?limit=20&offset=0",
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  );
}

async function recordOutcome(
  token,
  postId
) {
  return request(
    `/api/feed-analytics/outcome?post_id=${postId}&watched=true&skipped=false&completion_percent=75&watch_time=20&respected=true&shared=false&commented=true`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  );
}

async function main() {
  const variantCounts = {
    control: 0,
    level6: 0,
    unknown: 0,
  };

  const users = [];

  console.log(
    `Creating ${USER_COUNT} test users...`
  );

  for (
    let index = 1;
    index <= USER_COUNT;
    index++
  ) {
    try {
      const user =
        await registerUser(index);

      users.push(user);

      console.log(
        `Created user ${user.id}`
      );

      const firstFeed =
        await getFeed(
          user.token
        );

      const variant =
        firstFeed.body?.experiment
          ?.variant || "unknown";

      if (
        variant in variantCounts
      ) {
        variantCounts[variant]++;
      } else {
        variantCounts.unknown++;
      }

      console.log(
        `User ${user.id} → ${variant}`
      );

      /*
       * Generate several feed
       * impression batches.
       */
      for (
        let attempt = 0;
        attempt <
        FEED_REQUESTS_PER_USER;
        attempt++
      ) {
        await getFeed(
          user.token
        );

        await sleep(100);
      }

      /*
       * Record one outcome for
       * this user's first post.
       */
      const firstPost =
        firstFeed.body?.posts?.[0];

      if (firstPost?.id) {
        const outcome =
          await recordOutcome(
            user.token,
            firstPost.id
          );

        console.log(
          `Outcome user ${user.id}, post ${firstPost.id}: ${
            outcome.body?.success
          }`
        );
      }
    } catch (error) {
      console.error(
        "User seed error:",
        error.message
      );
    }
  }

  console.log("");
  console.log(
    "A/B seed completed"
  );

  console.log(
    "Variant distribution:",
    variantCounts
  );

  console.log(
    "Created users:",
    users.length
  );
}

main().catch((error) => {
  console.error(
    "Seed script failed:",
    error
  );

  process.exit(1);
});