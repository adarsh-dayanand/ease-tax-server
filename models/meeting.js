const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Meeting = sequelize.define("Meeting", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    serviceRequestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ServiceRequests',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    caId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'CAs',
        key: 'id'
      }
    },
    meetingType: {
      type: DataTypes.ENUM('video', 'phone', 'chat'),
      defaultValue: 'video'
    },
    platform: {
      type: DataTypes.ENUM('google_meet', 'zoom', 'microsoft_teams', 'phone', 'chat'),
      allowNull: true
    },
    scheduledDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    scheduledTime: {
      type: DataTypes.TIME,
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER, // Duration in minutes
      defaultValue: 60
    },
    status: {
      type: DataTypes.ENUM(
        'scheduled',
        'rescheduled',
        'cancelled',
        'completed',
        'no_show'
      ),
      defaultValue: 'scheduled'
    },
    meetingLink: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    meetingId: {
      type: DataTypes.STRING,
      allowNull: true // External platform meeting ID
    },
    meetingPassword: {
      type: DataTypes.STRING,
      allowNull: true
    },
    rescheduleCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    maxReschedules: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    rescheduleReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cancelledBy: {
      type: DataTypes.ENUM('user', 'ca', 'system'),
      allowNull: true
    },
    actualStartTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actualEndTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actualDuration: {
      type: DataTypes.INTEGER, // Actual duration in minutes
      allowNull: true
    },
    attendees: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    },
    agenda: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    actionItems: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    },
    recordingUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reminderSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    reminderSentAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    externalPlatformData: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'meetings',
    timestamps: true,
    indexes: [
      {
        fields: ['serviceRequestId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['caId']
      },
      {
        fields: ['scheduledDate']
      },
      {
        fields: ['status']
      },
      {
        fields: ['platform']
      },
      {
        fields: ['meetingId']
      }
    ]
  });

  Meeting.associate = (models) => {
    Meeting.belongsTo(models.ServiceRequest, {
      foreignKey: 'serviceRequestId',
      as: 'serviceRequest'
    });
    
    Meeting.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    Meeting.belongsTo(models.CA, {
      foreignKey: 'caId',
      as: 'ca'
    });
  };

  // Instance methods
  Meeting.prototype.canReschedule = function() {
    return this.rescheduleCount < this.maxReschedules && 
           this.status === 'scheduled';
  };

  Meeting.prototype.isUpcoming = function() {
    const now = new Date();
    const meetingDateTime = new Date(this.scheduledDate);
    return meetingDateTime > now && this.status === 'scheduled';
  };

  Meeting.prototype.isOverdue = function() {
    const now = new Date();
    const meetingDateTime = new Date(this.scheduledDate);
    const endTime = new Date(meetingDateTime.getTime() + (this.duration * 60000));
    return now > endTime && this.status === 'scheduled';
  };

  Meeting.prototype.getDuration = function() {
    if (this.actualStartTime && this.actualEndTime) {
      const start = new Date(this.actualStartTime);
      const end = new Date(this.actualEndTime);
      return Math.round((end - start) / (1000 * 60)); // Duration in minutes
    }
    return this.duration;
  };

  return Meeting;
};