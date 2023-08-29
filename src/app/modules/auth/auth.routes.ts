import express from 'express'
import reqValidate from '../../../middleware/reqValidate'
import { USER_ROLE } from '@prisma/client'
import { auth } from '../../../middleware/auth'
import {
  changePassword,
  forgetPassword,
  refreshToken,
  resetPassword,
  signIn,
  signUp,
} from './auth.controller'
import {
  changePasswordZod,
  forgetPasswordZod,
  refreshTokenZod,
  resetPasswordZod,
  signInZod,
  signUpZod,
} from './auth.validation'

const router = express.Router()

router.route('/signup').post(reqValidate(signUpZod), signUp)

router.route('/signin').post(reqValidate(signInZod), signIn)

router.route('/refresh-token').post(reqValidate(refreshTokenZod), refreshToken)

router
  .route('/change-password')
  .patch(
    auth(USER_ROLE.admin, USER_ROLE.user),
    reqValidate(changePasswordZod),
    changePassword
  )

router
  .route('/forget-password')
  .patch(reqValidate(forgetPasswordZod), forgetPassword)

router
  .route('/reset-password/:token')
  .patch(reqValidate(resetPasswordZod), resetPassword)

export default router
