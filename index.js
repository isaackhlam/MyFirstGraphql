const { ApolloServer, gql, ForbiddenError } = require("apollo-server");
const { isSpecifiedScalarType } = require("graphql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require('dotenv').config()

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);
const SECRET = process.env.SECRET;

// Fake Data
const meId = 1;
const users = [
  {
    id: 1,
    email: "fong@test.com",
    password: "$2b$04$wcwaquqi5ea1Ho0aKwkZ0e51/RUkg6SGxaumo8fxzILDmcrv4OBIO", // 123456
    name: "Fong",
    age: 23,
    friendIds: [2, 3],
  },
  {
    id: 2,
    email: "kevin@test.com",
    password: "$2b$04$uy73IdY9HVZrIENuLwZ3k./0azDvlChLyY1ht/73N4YfEZntgChbe", // 123456
    name: "Kevin",
    age: 40,
    friendIds: [1],
  },
  {
    id: 3,
    email: "mary@test.com",
    password: "$2b$04$UmERaT7uP4hRqmlheiRHbOwGEhskNw05GHYucU73JRf8LgWaqWpTy", // 123456
    name: "Mary",
    age: 18,
    friendIds: [1],
  },
];

const posts = [
  {
    id: 1,
    authorId: 1,
    title: "Hello World",
    body: "This is my first post",
    likeGiverIds: [1, 2],
    createdAt: "2018-10-22T01:40:14.941Z",
  },
  {
    id: 2,
    authorId: 2,
    title: "Nice Day",
    body: "Hello My Friend!",
    likeGiverIds: [1],
    createdAt: "2018-10-24T01:40:14.941Z",
  },
];

// Schema
const typeDefs = gql`
  type Query {
    "Testing Hello World"
    hello: String
    "Get current user"
    me: User
    "Get all users"
    users: [User]
    "Get specific user by name"
    user(name: String!): User
    "Get all post"
    posts: [Post]
    "Get specific post by ID"
    post(id: ID!): Post
  }
  """
  User
  """
  type User {
    "Identity"
    id: ID!
    "Email"
    email: String!
    "Name"
    name: String
    "Age"
    age: Int
    "friends"
    friends: [User]
    "Post"
    posts: [Post]
  }
  """
  Post
  """
  type Post {
    "Identity"
    id: ID!
    "Author"
    author: User
    "Title"
    title: String
    "Content"
    body: String
    "Like Giver"
    likeGivers: [User]
    "Create time (ISO format)"
    createdAt: String
  }

  type Token {
    token: String!
  }

  input UpdateMyInfoInput {
    name: String
    age: Int
  }

  input AddPostInput {
    title: String!
    body: String
  }

  type Mutation {
    updateMyInfo(input: UpdateMyInfoInput!): User
    addFriend(userId: ID!): User
    addPost(input: AddPostInput!): Post
    likePost(postId: ID!): Post
    "Sign up. Email and password is required"
    signUp(name: String, email: String!, password: String!): User
    "Login"
    login(email: String!, password: String!): Token
    deletePost(postId: ID!): Post
  }
`;

// Helper function
const filterPostsByUserID = (userId) =>
  posts.filter((post) => userId === post.authorId);

const filterUsersByUserIds = (userIds) =>
  users.filter((user) => userIds.includes(user.id));

const findUserByUserId = (userId) =>
  users.find((user) => user.id === Number(userId));

const findUserByName = (name) =>
  users.find((user) => user.name === name);

const findPostByPostId = (postID) =>
  posts.find((post) => post.id === Number(postID));

const updateUserInfo = (userId, data) =>
  Object.assign(findUserByUserId(userId), data);

const addPost = ({ authorId, title, body }) =>
(posts[posts.length] = {
  id: posts[posts.length - 1].id + 1,
  authorId,
  title,
  body,
  likeGiverIds: [],
  createdAt: new Date().toISOString(),
});

const updatePost = (postID, data) =>
  Object.assign(findPostByPostId(postID), data);

const hash = (text, saltRounds) => bcrypt.hash(text, saltRounds);

const addUser = ({ name, email, password }) => (
  users[users.length] = {
    id: users[users.length - 1].id + 1,
    name,
    email,
    password
  }
);

const createToken = ({ id, email, name }, secret) =>
  jwt.sign({ id, email, name }, secret, { expiresIn: "1d" });

const isAuthenticated = resolverFunc => (parent, args, context) => {
  if (!context.me) throw new ForbiddenError("Not logged in.");
  return resolverFunc.apply(null, [parent, args, context]);
};

const deletePost = postId =>
  posts.splice(posts.findIndex(post => post.id === postId), 1)[0];

const isPostAuthor = resolverFunc => (parent, args, context) => {
  const { postId } = args;
  const { me } = context;
  const isAuthor = findPostByPostId(postId).authorId === me.id;
  if (!isAuthor) throw new ForbiddenError("Only Author Can Delete this Post");
  return resolverFunc.apply(null, [parent, args, context]);
}

// Resolvers
const resolvers = {
  Query: {
    hello: () => "world",
    me: isAuthenticated((parent, args, { me }) => findUserByUserId(me.id)),
    users: () => users,
    user: (root, { name }, context) => findUserByName(name),
    posts: () => posts,
    post: (root, { id }, context) => findPostByPostId(id),
  },
  User: {
    posts: (parent, args, context) => filterPostsByUserID(parent.id),
    friends: (parent, args, context) =>
      filterUsersByUserIds(parent.friendIds || []),
  },
  Post: {
    author: (parent, args, context) => findUserByUserId(parent.authorId),
    likeGivers: (parent, args, context) =>
      filterUsersByUserIds(parent.likeGiverIds),
  },
  Mutation: {
    updateMyInfo: isAuthenticated((parent, args, { me }) => {
      const data = ["name", "age"].reduce(
        (obj, key) => (input[key] ? { ...obj, [key]: input[key] } : obj),
        {}
      );

      return updateUserInfo(me.id, data);
    }),
    addFriend: isAuthenticated((parent, { userId }, { me: { id: meId } }) => {
      const me = findUserByUserId(meId);
      if (me.friendIds.includes(userId))
        throw new Error(`User ${userID} Already Friend.`);
      const friend = findUserByUserId(userId);
      const newMe = updateUserInfo(meId, {
        friendIds: me.friendIds.concat(userId),
      });
      updateUserInfo(userId, { friendIds: friend.friendIds.concat(meId) });

      return newMe;
    }),
    addPost: isAuthenticated((parent, { input }, { me }) => {
      const { title, body } = input;
      return addPost({ authorId: me.id, title, body });
    }),
    likePost: isAuthenticated((parent, { postId }, { me }) => {
      const post = findPostByPostId(postId);
      if (!post) throw new Error(`Post ${postId} Not Exists`);

      if (!post.likeGiverIds.includes(postId)) {
        return updatePost(postId, {
          likeGiverIds: post.likeGiverIds.concat(me.id),
        });
      }

      return updatePost(postId, {
        likeGiverIds: post.likeGiverIds.filter(id => id === me.id),
      });
    }),
    signUp: async (root, { name, email, password }, { saltRounds }) => {
      const isUserEmailDuplicate = users.some(user => user.email === email);
      if (isUserEmailDuplicate) throw new Error("User Email Duplicate");
      const hashedPassword = await hash(password, saltRounds);
      return addUser({ name, email, password: hashedPassword });
    },
    login: async (root, { email, password }, { secret }) => {
      const user = users.find(user => user.email === email);
      if (!user) throw new Error("Email Account Not Exists");
      const passwordIsValid = await bcrypt.compare(password, user.password);
      if (!passwordIsValid) throw new AuthenticationError("Wrong Password");
      return { token: await createToken(user, secret) };
    },
    deletePost: isAuthenticated(
      isPostAuthor((root, { postId }, { me }) => deletePost(postId))
    ),
  },
};

// init Web Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const context = { secret: SECRET, saltRounds: SALT_ROUNDS };
    const token = req.headers["x-token"];
    if (token) {
      try {
        const me = await jwt.verify(token, SECRET);
        return { me };
      } catch (e) {
        throw new Error("Your session expired. Sign in again.");
      }
    }
    return context;
  }
});

// Start Server
server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`);
  console.log(SALT_ROUNDS)
  console.log(SECRET)
  console.log()
});
