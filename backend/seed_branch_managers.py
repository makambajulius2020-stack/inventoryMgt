from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

from app.auth.password import hash_password
from app.db.mysql import SessionLocal
from app.models.master import Location
from app.models.rbac import Role, User, UserRole


@dataclass(frozen=True)
class BranchSeed:
    name: str
    email_username: str


BRANCHES: list[BranchSeed] = [
    BranchSeed(name="The Patiobela", email_username="thepatiobela@company.com"),
    BranchSeed(name="The Maze Bistro", email_username="themazebistro@company.com"),
    BranchSeed(name="The Maze Forest Mall", email_username="themazeforestmall@company.com"),
    BranchSeed(name="Itaru", email_username="itaru@company.com"),
    BranchSeed(name="Rosa Dames", email_username="rosadames@company.com"),
]

ROLE_NAME = "BRANCH_MANAGER"
BRAND = "Hugamara"


def main() -> None:
    temp_password = input("Temporary password for ALL branch managers: ").strip()
    if not temp_password:
        raise SystemExit("Password cannot be empty")

    db = SessionLocal()
    try:
        role = db.execute(select(Role).where(Role.name == ROLE_NAME)).scalar_one_or_none()
        if role is None:
            role = Role(name=ROLE_NAME)
            db.add(role)
            db.flush()

        loc_by_name: dict[str, Location] = {}
        for b in BRANCHES:
            loc = db.execute(select(Location).where(Location.name == b.name)).scalar_one_or_none()
            if loc is None:
                loc = Location(name=b.name, brand=BRAND, is_active=True)
                db.add(loc)
                db.flush()
            else:
                if not loc.is_active:
                    loc.is_active = True
                if not loc.brand:
                    loc.brand = BRAND
            loc_by_name[b.name] = loc

        for b in BRANCHES:
            loc = loc_by_name[b.name]
            user = db.execute(select(User).where(User.username == b.email_username)).scalar_one_or_none()
            if user is None:
                user = User(
                    username=b.email_username,
                    password_hash=hash_password(temp_password),
                    is_active=True,
                    location_id=loc.id,
                )
                db.add(user)
                db.flush()
            else:
                if user.location_id != loc.id:
                    user.location_id = loc.id
                if not user.is_active:
                    user.is_active = True

            ur = (
                db.execute(select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id))
                .scalar_one_or_none()
            )
            if ur is None:
                db.add(UserRole(user_id=user.id, role_id=role.id))

        db.commit()

        print("\nSeed complete. Locations:")
        for b in BRANCHES:
            loc = loc_by_name[b.name]
            print(f"- {loc.id}: {loc.name}")

        print("\nBranch manager users:")
        for b in BRANCHES:
            u = db.execute(select(User).where(User.username == b.email_username)).scalar_one()
            print(f"- {u.username} (location_id={u.location_id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
