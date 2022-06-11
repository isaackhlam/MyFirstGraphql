const { ApolloServer, gql } = require("apollo-server");
const { isSpecifiedScalarType } = require("graphql");

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
    passwrod: "$2b$04$uy73IdY9HVZrIENuLwZ3k./0azDvlChLyY1ht/73N4YfEZntgChbe", // 123456
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

// Resolvers
const resolvers = {
  Query: {
    hello: () => "world",
    me: () => findUserByUserId(meId),
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
    updateMyInfo: (parent, { userId }, context) => {
      const data = ["name", "age"].reduce(
        (obj, key) => (input[key] ? { ...obj, [key]: input[key] } : obj),
        {}
      );

      return updateUserInfo(meId, data);
    },
    addFriend: (parent, { userId }, context) => {
      const me = findUserByUserId(meId);
      if (me.friendIds.includes(userId))
        throw new Error(`User ${userID} Already Friend.`);
      const friend = findUserByUserId(userId);
      const newMe = updateUserInfo(meId, {
        friendIds: me.friendIds.concat(userId),
      });
      updateUserInfo(userId, { friendIds: friend.friendIds.concat(meId) });

      return newMe;
    },
    addPost: (parent, { input }, context) => {
      const { title, body } = input;
      return addPost({ authorId: meId, title, body });
    },
    likePost: (parent, { postId }, context) => {
      const post = findPostByPostId(postId);
      if (!post) throw new Error(`Post ${postId} Not Exists`);

      if (!post.likeGiverIds.includes(postId)) {
        return updatePost(postId, {
          likeGiverIds: post.likeGiverIds.concat(meId),
        });
      }

      return updatePost(postId, {
        likeGiverIds: post.likeGiverIds.filter((id) => id === meid),
      });
    },
  },
};

// init Web Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Start Server
server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`);
});
