"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonValidations = void 0;
exports.validateRequest = validateRequest;
exports.sanitizeInput = sanitizeInput;
exports.withValidation = withValidation;
const express_validator_1 = require("express-validator");
function validateRequest(rules) {
    return async (req, res, next) => {
        await Promise.all(rules.map(rule => rule.run(req)));
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }
        next();
    };
}
exports.commonValidations = {
    email: (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .trim()
        .escape(),
    password: (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    amount: (0, express_validator_1.body)('amount')
        .isFloat({ min: 0 })
        .toFloat(),
    description: (0, express_validator_1.body)('description')
        .trim()
        .escape()
        .isLength({ max: 1000 }),
    abn: (0, express_validator_1.body)('abn')
        .optional()
        .matches(/^\d{11}$/)
        .withMessage('ABN must be 11 digits'),
    phoneNumber: (0, express_validator_1.body)('phoneNumber')
        .optional()
        .matches(/^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/)
        .withMessage('Invalid Australian phone number'),
    postcode: (0, express_validator_1.body)('postcode')
        .optional()
        .matches(/^\d{4}$/)
        .withMessage('Australian postcode must be 4 digits'),
};
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return input
            .replace(/[<>]/g, '')
            .trim();
    }
    if (Array.isArray(input)) {
        return input.map(sanitizeInput);
    }
    if (input && typeof input === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    return input;
}
function withValidation(handler, validations = []) {
    return async (req, res) => {
        // Sanitize input
        if (req.body) {
            req.body = sanitizeInput(req.body);
        }
        if (req.query) {
            req.query = sanitizeInput(req.query);
        }
        // Run validations
        if (validations.length > 0) {
            await Promise.all(validations.map(validation => validation.run(req)));
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
        }
        // Execute handler
        try {
            await handler(req, res);
        }
        catch (error) {
            console.error('Handler error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}
