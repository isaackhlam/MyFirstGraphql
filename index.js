const { ApolloServer } = require("apollo-server");
const { isSpecifiedScalarType } = require("graphql");
const { typeDefs, resolvers } = require("./schema");
const { userModel, postModel } = require('./models');
const jwt = require("jsonwebtoken");

require('dotenv').config()

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);
const SECRET = process.env.SECRET;

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
});
