const logger = require('../utils/logger');

/**
 * WebSocket Service for real-time updates
 * Handles broadcasting updates to connected clients via Socket.IO
 */
class WebSocketService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Broadcast active week updates to subscribed clients
   * @param {number} year - Season year
   * @param {object} data - Active week data
   */
  broadcastActiveWeekUpdate(year, data) {
    const room = `activeWeek:${year}`;
    const clientCount = this.io.sockets.adapter.rooms.get(room)?.size || 0;

    this.io.to(room).emit('activeWeek:update', data);

    logger.debug('Broadcasted active week update', {
      year,
      clients: clientCount,
      hasData: !!data
    });
  }

  /**
   * Broadcast rule voting updates to subscribed clients
   * @param {number} year - Season year
   * @param {number} proposalId - Rule proposal ID
   * @param {array} votes - Updated votes array
   */
  broadcastRuleVoteUpdate(year, proposalId, votes) {
    const room = `rules:${year}`;
    const clientCount = this.io.sockets.adapter.rooms.get(room)?.size || 0;

    this.io.to(room).emit('rule:voteUpdate', { proposalId, votes });

    logger.debug('Broadcasted vote update', {
      year,
      proposalId,
      voteCount: votes?.length || 0,
      clients: clientCount
    });
  }

  /**
   * Broadcast keeper lock status change to all clients
   * @param {number} year - Season year
   * @param {boolean} locked - Lock status
   */
  broadcastKeeperLockUpdate(year, locked) {
    this.io.emit('keeper:lockUpdate', { year, locked });

    logger.debug('Broadcasted keeper lock update', {
      year,
      locked,
      totalClients: this.io.sockets.sockets.size
    });
  }

  /**
   * Broadcast team season updates (standings changes)
   * @param {number} year - Season year
   * @param {array} teamSeasons - Updated team seasons data
   */
  broadcastTeamSeasonsUpdate(year, teamSeasons) {
    const room = `seasons:${year}`;
    const clientCount = this.io.sockets.adapter.rooms.get(room)?.size || 0;

    this.io.to(room).emit('teamSeasons:update', { year, teamSeasons });

    logger.debug('Broadcasted team seasons update', {
      year,
      seasonCount: teamSeasons?.length || 0,
      clients: clientCount
    });
  }

  /**
   * Send notification to a specific manager
   * @param {string} managerId - Manager name_id
   * @param {object} notification - Notification object
   */
  sendManagerNotification(managerId, notification) {
    // Find all sockets belonging to this manager
    const sockets = Array.from(this.io.sockets.sockets.values());
    const managerSockets = sockets.filter(s => s.managerId === managerId);

    managerSockets.forEach(socket => {
      socket.emit('notification', notification);
    });

    if (managerSockets.length > 0) {
      logger.debug('Sent notification to manager', {
        managerId,
        socketCount: managerSockets.length,
        notificationType: notification?.type
      });
    }
  }

  /**
   * Get connection statistics
   * @returns {object} Connection stats
   */
  getStats() {
    const totalConnections = this.io.sockets.sockets.size;
    const rooms = Array.from(this.io.sockets.adapter.rooms.entries())
      .filter(([name]) => !name.includes('/')); // Filter out socket IDs

    return {
      totalConnections,
      rooms: rooms.map(([name, sockets]) => ({
        name,
        clients: sockets.size
      }))
    };
  }
}

module.exports = WebSocketService;
