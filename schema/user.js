const { gql, ForbiddenError, AuthenticationError } = require("apollo-server")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

const typeDefs = gql`
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

  extend type Query {
    "Get current user"
    me: User
    "Get all users"
    users: [User]
    "Get specific user by name"
    user(name: String!): User
  }

  input UpdateMyInfoInput {
    name: String
    age: Int
  }

  type Token {
    token: String!
  }

  extend type Mutation {
    updateMyInfo(input: UpdateMyInfoInput!): User
    addFriend(userId: ID!): User
    "Sign up. Email and password is required"
    signUp(name: String, email: String!, password: String!): User
    "Login"
    login(email: String!, password: String!): Token
  }
`;

// Helper functions
const hash = (text, saltRounds) => bcrypt.hash(text, saltRounds);

const createToken = ({ id, email, name }, secret) =>
	jwt.sign({ id, email, name }, secret, { expiresIn: "1d" });

const isAuthenticated = resolverFunc => (parent, args, context) => {
	if (!context.me) throw new ForbiddenError("Not logged in.");
	return resolverFunc.apply(null, [parent, args, context]);
};

//Resolvers

const resolvers = {
  Query: {
    me: isAuthenticated((parent, args, { me, userModel }) =>
			userModel.findUserByUserId(me.id)
		),
		users: (root, args, { userModel }) => userModel.getAllUsers(),
		user: (root, { name }, { userModel }) => userModel.findUserByName(name),
  },
  User: {
		posts: (parent, args, { postModel }) =>
			postModel.filterPostsByUserID(parent.id),
		friends: (parent, args, { userModel }) =>
			userModel.filterUsersByUserIds(parent.friendIds || []),
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
  }
}

module.exports = {
  typeDefs,
  resolvers
}