import { User } from '@prisma/client'
import prisma from '../../../utilities/prisma'
import bcrypt from 'bcrypt'
import config from '../../../config'
import httpStatus from 'http-status'
import { createToken, verifyToken } from '../../../helpers/jwtHelpers'
import { Secret } from 'jsonwebtoken'
import {
  IAuthSignin,
  IAuthSigninResponse,
  IChangePassword,
  IRefreshTokenResponse,
} from './auth.interfaces'
import { isExist, isPasswordMatched } from './auth.utils'
import { ApiError } from './../../../errorFormating/apiError'

export const signUpService = async (data: User): Promise<User | null> => {
  // existency check
  const [email, phone] = await Promise.all([
    isExist(data.email),
    isExist(data.phone),
  ])

  if (email || phone) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `${email ? 'Email' : ''}${email && phone ? ' & ' : ''}${
        phone ? 'Phone number' : ''
      } already ${email || phone ? 'exists' : ''}`
    )
  }

  // save new user
  const { password } = data
  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_solt_round)
  )
  data.password = hashedPassword

  const result = await prisma.user.create({
    data,
  })

  if (!result) {
    throw new Error(`User create failed`)
  }

  return result
}

export const signInService = async (
  data: IAuthSignin
): Promise<IAuthSigninResponse | null> => {
  // existency check
  const user = await isExist(data.email)
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }

  // Password check
  const passwordMatch = await bcrypt.compare(data.password, user.password)
  if (!passwordMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password is incorrect')
  }

  // Create Access Token
  const { id, role, phone, name, email } = user
  const accessToken = createToken(
    { id, role, phone, name, email },
    config.jwt.secret as Secret,
    config.jwt.expires_in as string
  )

  // Create Refresh Token
  const refreshToken = createToken(
    { id, role, phone, name, email },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string
  )

  return {
    accessToken,
    refreshToken,
  }
}

export const refreshTokenService = async (
  token: string
): Promise<IRefreshTokenResponse> => {
  let verifiedToken = null
  try {
    verifiedToken = verifyToken(token, config.jwt.refresh_secret as Secret)
  } catch (err) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid refresh token')
  }

  const { email } = verifiedToken
  // Existency Check
  const user = await isExist(email)
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist')
  }

  //Generate New Access Token
  const newAccessToken = createToken(
    {
      id: user.id,
      role: user.role,
      phone: user.phone,
      name: user.name,
      email: user.email,
    },
    config.jwt.secret as Secret,
    config.jwt.expires_in as string
  )

  return {
    accessToken: newAccessToken,
  }
}

export const changePasswordService = async (
  payload: IChangePassword,
  user: Partial<User>
) => {
  const { oldPassword, newPassword } = payload
  const { email } = user
  const isUserExist = await isExist(email as string)

  if (!isUserExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }

  if (
    isUserExist.password &&
    !(await isPasswordMatched(oldPassword, isUserExist.password))
  ) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Old password is incorrect')
  }

  // hass
  const newHashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_solt_round)
  )

  const updatedData = {
    password: newHashedPassword,
  }

  await prisma.user.update({
    where: { email },
    data: updatedData,
  })
}
