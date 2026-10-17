import { Request } from 'express'
import { IUserWithId } from '../../_shared/types/users.interface'

export interface IMyUser extends Request {
    authenticatedUser: IUserWithId
}
