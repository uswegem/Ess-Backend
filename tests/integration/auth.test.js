const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');

describe('Authentication Flow Integration Tests', () => {
    const testUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!',
        role: 'user'
    };

    let authToken;

    beforeAll(async () => {
        // Clean up existing test user
        await User.deleteOne({ username: testUser.username });
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteOne({ username: testUser.username });
    });

    describe('POST /auth/register', () => {
        it('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send(testUser);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('registered successfully');
        });

        it('should not register duplicate username', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send(testUser);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({ username: 'onlyusername' });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /auth/login', () => {
        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.username).toBe(testUser.username);

            // Save token for protected route tests
            authToken = response.body.token;
        });

        it('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    username: testUser.username,
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should reject non-existent user', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'password123'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('Protected Routes', () => {
        it('should access protected route with valid token', async () => {
            const response = await request(app)
                .get('/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.username).toBe(testUser.username);
        });

        it('should reject access without token', async () => {
            const response = await request(app)
                .get('/auth/profile');

            expect(response.status).toBe(401);
        });

        it('should reject access with invalid token', async () => {
            const response = await request(app)
                .get('/auth/profile')
                .set('Authorization', 'Bearer invalidtoken');

            expect(response.status).toBe(403);
        });

        it('should reject expired token', async () => {
            // Create an expired token
            const expiredToken = jwt.sign(
                { userId: 'test', username: testUser.username },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1ms' }
            );

            // Wait for token to expire
            await new Promise(resolve => setTimeout(resolve, 100));

            const response = await request(app)
                .get('/auth/profile')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('Token Validation', () => {
        it('should validate token format', async () => {
            const invalidFormats = [
                'Bearer',
                'Bearer ',
                'InvalidFormat token',
                'token'
            ];

            for (const format of invalidFormats) {
                const response = await request(app)
                    .get('/auth/profile')
                    .set('Authorization', format);

                expect(response.status).toBe(401);
            }
        });

        it('should accept valid Bearer token format', async () => {
            const response = await request(app)
                .get('/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
        });
    });
});
