const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const supportTicketController = require('../controllers/helpcenter.controller');

router.use(authenticate);

router.route('/')
  .get(supportTicketController.getAllSupportTickets)
  .post( supportTicketController.createSupportTicket);

router.route('/:id')
  .get(supportTicketController.getSupportTicket);

router.route('/:id/responses')
  .post( supportTicketController.addTicketResponse);

router.route('/:id/status')
  .put(  supportTicketController.updateTicketStatus);

module.exports = router;