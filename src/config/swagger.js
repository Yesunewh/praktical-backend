const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const devPort = process.env.PORT || 5050;

// Swagger configuration
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Practikal Platform",
    version: "1.0.0",
    description: "API documentation for the Practikal Multi-Tenant Training Platform",
  },
  servers: [
    {
      url: "https://practikalbackend.paperless.et/api",
      description: "Production Server",
    },
    /*
    {
      url: `http://localhost:${devPort}/api`,
      description: "Local Development Server",
    },
    */
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./src/docs/*.js"], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = {
  swaggerUi,
  swaggerSpec,
};
