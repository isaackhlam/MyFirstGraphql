const {	gql } = require("apollo-server")

const userSchema = require("./user")
const postSchema = require("./post")


const typeDefs = gql`
  type Query {
    "Testing Hello World"
    hello: String
  }

	type Mutation {
		test: Boolean
	}
`;

const resolvers = {
	Query: {
		hello: () => "world"
	},
	Mutation: {
		test: () => "test"
	}
};

module.exports = {
	typeDefs: [typeDefs, userSchema.typeDefs, postSchema.typeDefs],
	resolvers: [resolvers, userSchema.resolvers, postSchema.resolvers]
}