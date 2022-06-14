const { gql, ForbiddenError } = require("apollo-server")

const typeDefs = gql`
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

  extend type Query {
    "Get all post"
    posts: [Post]
    "Get specific post by ID"
    post(id: ID!): Post
  }

  input AddPostInput {
    title: String!
    body: String
  }

  extend type Mutation {
    addPost(input: AddPostInput!): Post
    likePost(postId: ID!): Post
    deletePost(postId: ID!): Post
  }
`;
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

const resolvers = {
  Query: {
    posts: (root, args, { postModel }) => postModel.getAllPosts(),
		post: (root, { id }, { postModel }) =>
			postModel.findPostByPostId(Number(id)),
  },

  Post: {
    author: (parent, args, { userModel }) =>
			userModel.findUserByUserId(parent.authorId),
		likeGivers: (parent, args, { userModel }) =>
			userModel.filterUsersByUserIds(parent.likeGiverIds),
  },

  Mutation: {
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
		
		deletePost: isAuthenticated(
			isPostAuthor((root, { postId }, { me }) => deletePost(postId))
		),
  }
}

module.exports = {
  typeDefs,
  resolvers
};