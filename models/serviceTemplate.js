"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class ServiceTemplate extends Model {
    static associate(models) {
      // ServiceTemplate doesn't directly associate with other models
      // It serves as a reference template for CA services
    }

    // Instance methods
    toJSON() {
      const values = Object.assign({}, this.get());

      // Parse decimal values
      if (values.defaultBasePrice) {
        values.defaultBasePrice = parseFloat(values.defaultBasePrice);
      }

      return values;
    }

    // Static methods
    static async getByServiceType(serviceType) {
      return await this.findOne({
        where: {
          serviceType,
          isActive: true,
        },
      });
    }

    static async getAllActive() {
      return await this.findAll({
        where: { isActive: true },
        order: [
          ["displayOrder", "ASC"],
          ["serviceName", "ASC"],
        ],
      });
    }

    static async getByCategory(category) {
      return await this.findAll({
        where: {
          category,
          isActive: true,
        },
        order: [
          ["displayOrder", "ASC"],
          ["serviceName", "ASC"],
        ],
      });
    }
  }

  ServiceTemplate.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      serviceType: {
        type: DataTypes.ENUM(
          "tax_filing",
          "gst_registration",
          "gst_filing",
          "company_registration",
          "tax_planning",
          "audit_services",
          "compliance_check",
          "financial_consultation"
        ),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          isIn: [
            [
              "tax_filing",
              "gst_registration",
              "gst_filing",
              "company_registration",
              "tax_planning",
              "audit_services",
              "compliance_check",
              "financial_consultation",
            ],
          ],
        },
      },
      serviceName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [3, 200],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: [0, 1000],
        },
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: [0, 100],
        },
      },
      defaultBasePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 999999.99,
        },
      },
      priceRange: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        validate: {
          isValidPriceRange(value) {
            if (value && typeof value === "object") {
              if (
                value.min !== undefined &&
                (typeof value.min !== "number" || value.min < 0)
              ) {
                throw new Error("Price range min must be a positive number");
              }
              if (
                value.max !== undefined &&
                (typeof value.max !== "number" || value.max < 0)
              ) {
                throw new Error("Price range max must be a positive number");
              }
              if (
                value.min !== undefined &&
                value.max !== undefined &&
                value.min > value.max
              ) {
                throw new Error("Price range min cannot be greater than max");
              }
            }
          },
        },
      },
      estimatedDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 365,
        },
      },
      requirements: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        validate: {
          isArray(value) {
            if (value && !Array.isArray(value)) {
              throw new Error("Requirements must be an array");
            }
          },
        },
      },
      features: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        validate: {
          isArray(value) {
            if (value && !Array.isArray(value)) {
              throw new Error("Features must be an array");
            }
          },
        },
      },
      suggestedAdditionalCharges: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        validate: {
          isValidCharges(value) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              for (const [key, charge] of Object.entries(value)) {
                if (typeof charge !== "object" || charge === null) {
                  throw new Error(
                    `Additional charge '${key}' must be an object`
                  );
                }
                if (typeof charge.amount !== "number" || charge.amount < 0) {
                  throw new Error(
                    `Additional charge '${key}' amount must be a positive number`
                  );
                }
              }
            }
          },
        },
      },
      complexity: {
        type: DataTypes.ENUM("basic", "intermediate", "advanced"),
        allowNull: true,
        defaultValue: "basic",
        validate: {
          isIn: [["basic", "intermediate", "advanced"]],
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: "ServiceTemplate",
      tableName: "ServiceTemplates",
      timestamps: true,
      indexes: [
        {
          fields: ["serviceType"],
        },
        {
          fields: ["category"],
        },
        {
          fields: ["isActive"],
        },
        {
          fields: ["displayOrder"],
        },
      ],
    }
  );

  return ServiceTemplate;
};
