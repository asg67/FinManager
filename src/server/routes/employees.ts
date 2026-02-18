import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { inviteEmployeeSchema, updateEmployeeSchema } from "../schemas/employee.js";

const router = Router();

router.use(authMiddleware);

// Only owners can manage employees
function ownerOnly(req: Request, res: Response): boolean {
  if (req.user!.role !== "owner") {
    res.status(403).json({ message: "Only owners can manage employees" });
    return false;
  }
  return true;
}

// POST /api/employees/invite — create employee account
router.post("/invite", validate(inviteEmployeeSchema), async (req: Request, res: Response) => {
  try {
    if (!ownerOnly(req, res)) return;

    const { email, password, name, entityIds, permissions } = req.body;
    const ownerId = req.user!.userId;

    // Check email not taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    // Verify all entities belong to this owner
    const entities = await prisma.entity.findMany({
      where: { id: { in: entityIds }, ownerId },
    });
    if (entities.length !== entityIds.length) {
      res.status(400).json({ message: "Some entities not found or not owned by you" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const employee = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "employee",
        invitedById: ownerId,
        permission: {
          create: permissions,
        },
        entityAccess: {
          create: entityIds.map((entityId: string) => ({ entityId })),
        },
      },
      include: {
        permission: true,
        entityAccess: { include: { entity: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json({
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
      createdAt: employee.createdAt.toISOString(),
      permissions: employee.permission
        ? {
            dds: employee.permission.dds,
            pdfUpload: employee.permission.pdfUpload,
            analytics: employee.permission.analytics,
            export: employee.permission.export,
          }
        : null,
      entities: employee.entityAccess.map((ea) => ea.entity),
    });
  } catch (error) {
    console.error("Invite employee error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/employees — list employees invited by current owner
router.get("/", async (req: Request, res: Response) => {
  try {
    if (!ownerOnly(req, res)) return;

    const ownerId = req.user!.userId;

    const employees = await prisma.user.findMany({
      where: { invitedById: ownerId, role: "employee" },
      include: {
        permission: true,
        entityAccess: { include: { entity: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(
      employees.map((emp) => ({
        id: emp.id,
        email: emp.email,
        name: emp.name,
        role: emp.role,
        createdAt: emp.createdAt.toISOString(),
        permissions: emp.permission
          ? {
              dds: emp.permission.dds,
              pdfUpload: emp.permission.pdfUpload,
              analytics: emp.permission.analytics,
              export: emp.permission.export,
            }
          : null,
        entities: emp.entityAccess.map((ea) => ea.entity),
      })),
    );
  } catch (error) {
    console.error("List employees error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/employees/:id — update employee permissions / entity access
router.put("/:id", validate(updateEmployeeSchema), async (req: Request, res: Response) => {
  try {
    if (!ownerOnly(req, res)) return;

    const ownerId = req.user!.userId;
    const employeeId = req.params.id as string;

    // Verify employee belongs to this owner
    const employee = await prisma.user.findFirst({
      where: { id: employeeId, invitedById: ownerId, role: "employee" },
    });
    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const { name, entityIds, permissions } = req.body;

    // Update name if provided
    if (name) {
      await prisma.user.update({ where: { id: employeeId }, data: { name } });
    }

    // Update permissions if provided
    if (permissions) {
      await prisma.permission.upsert({
        where: { userId: employeeId },
        update: permissions,
        create: { userId: employeeId, ...permissions },
      });
    }

    // Update entity access if provided
    if (entityIds) {
      // Verify all entities belong to owner
      const entities = await prisma.entity.findMany({
        where: { id: { in: entityIds }, ownerId },
      });
      if (entities.length !== entityIds.length) {
        res.status(400).json({ message: "Some entities not found or not owned by you" });
        return;
      }

      // Replace entity access
      await prisma.entityAccess.deleteMany({ where: { userId: employeeId } });
      await prisma.entityAccess.createMany({
        data: entityIds.map((entityId: string) => ({ userId: employeeId, entityId })),
      });
    }

    // Fetch updated employee
    const updated = await prisma.user.findUnique({
      where: { id: employeeId },
      include: {
        permission: true,
        entityAccess: { include: { entity: { select: { id: true, name: true } } } },
      },
    });

    res.json({
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      role: updated!.role,
      createdAt: updated!.createdAt.toISOString(),
      permissions: updated!.permission
        ? {
            dds: updated!.permission.dds,
            pdfUpload: updated!.permission.pdfUpload,
            analytics: updated!.permission.analytics,
            export: updated!.permission.export,
          }
        : null,
      entities: updated!.entityAccess.map((ea) => ea.entity),
    });
  } catch (error) {
    console.error("Update employee error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/employees/:id — remove employee
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!ownerOnly(req, res)) return;

    const ownerId = req.user!.userId;
    const employeeId = req.params.id as string;

    const employee = await prisma.user.findFirst({
      where: { id: employeeId, invitedById: ownerId, role: "employee" },
    });
    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    await prisma.user.delete({ where: { id: employeeId } });

    res.status(204).send();
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
