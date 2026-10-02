import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { UserMenusService } from "./user-menus.service";

@Controller("menus")
@UseGuards(UserAuthGuard)
export class UserMenusController {
  constructor(private readonly menus: UserMenusService) {}

  @Get()
  list() {
    return this.menus.get();
  }
}
