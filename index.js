const { ApolloServer, gql, ForbiddenError } = require("apollo-server");
const { isSpecifiedScalarType } = require("graphql");
const { userModel, postModel } = require('./models');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require('dotenv').config()

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);
const SECRET = process.env.SECRET;

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
const hash = (text, saltRounds) => bcrypt.hash(text, saltRounds);

const createToken = ({ id, email, name }, secret) =>
  jwt.sign({ id, email, name }, secret, { expiresIn: "1d" });

const isAuthenticated = resolverFunc => (parent, args, context) => {
  if (!context.me) throw new ForbiddenError("Not logged in.");
  return resolverFunc.apply(null, [parent, args, context]);
};

const isPostAuthor = resolverFunc => (parent, args, context) => {
  const { postId } = args;
  const { me, postModel } = context;
  const isAuthor = postModel.findPostByPostId(Number(postId)).authorId === me.id
  if (!isAuthor) throw new ForbiddenError("Only Author Can Delete this Post");
  return resolverFunc.apply(null, [parent, args, context]);
}

// Resolvers
const resolvers = {
  Query: {
    hello: () => "world",
    me: isAuthenticated((parent, args, { me, userModel }) =>
      userModel.findUserByUserId(me.id)
    ),
    users: (root, args, { userModel }) => userModel.getAllUsers(),
    user: (root, { name }, { userModel }) => userModel.findUserByName(name),
    posts: (root, args, { postModel }) => postModel.getAllPosts(),
    post: (root, { id }, { postModel }) =>
      postModel.findPostByPostId(Number(id)),
  },
  User: {
    posts: (parent, args, { postModel }) =>
      postModel.filterPostsByUserID(parent.id),
    friends: (parent, args, { userModel }) =>
      userModel.filterUsersByUserIds(parent.friendIds || []),
  },
  Post: {
    author: (parent, args, { userModel }) =>
      userModel.findUserByUserId(parent.authorId),
    likeGivers: (parent, args, { userModel }) =>
      userModel.filterUsersByUserIds(parent.likeGiverIds),
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
      userId = Number(userId)
      const me = findUserByUserId(meId);
      if (me.friendIds.includes(userId))
        throw new Error(`User ${userId} Already Friend.`);
      const friend = findUserByUserId(userId);
      const newMe = updateUserInfo(me.id, {
        friendIds: me.friendIds.concat(userId),
      });
      updateUserInfo(userId, { friendIds: friend.friendIds.concat(me.id) });

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
    const context = {
      secret: SECRET,
      saltRounds: SALT_ROUNDS,
      userModel,
      postModel
    };
    const token = req.headers["x-token"];
    if (token) {
      try {
        const me = await jwt.verify(token, SECRET);
        return { ...context, me };
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
