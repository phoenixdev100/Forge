import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * Burn roughly the same CPU as a real verification when the account does not
 * exist, so response timing does not reveal which emails are registered.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.ucB1kV2z8bIbcV9zqEr9xQ8hYtwqOeS';
export const fakeVerify = () => bcrypt.compare('not-a-real-password', DUMMY_HASH);
