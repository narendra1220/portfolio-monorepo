import { ulid } from "ulid";
import type { MongoHandles } from "../mongo.js";
import type { Service, ServiceManifest, ServiceVersionDoc } from "../types.js";

export interface ServiceSearchOptions {
  query?: string;
  tier?: string;
  lifecycle?: string;
  team?: string;
  tag?: string;
  limit?: number;
}

export class ServicesRepo {
  constructor(private readonly mongo: MongoHandles) {}

  async upsertManifest(
    manifest: ServiceManifest,
    actor: string,
  ): Promise<{ service: Service; created: boolean; versionBumped: boolean }> {
    const now = Date.now();
    const existing = await this.mongo.services.findOne({ id: manifest.id });
    if (!existing) {
      const doc: Service = {
        _id: ulid(),
        ...manifest,
        version: 1,
        registeredAt: now,
        updatedAt: now,
      };
      await this.mongo.services.insertOne(doc);
      await this.recordVersion(doc._id, doc.id, 1, manifest, actor, now);
      return { service: doc, created: true, versionBumped: true };
    }
    const changed = manifestChanged(existing, manifest);
    if (!changed) {
      return { service: existing, created: false, versionBumped: false };
    }
    const nextVersion = (existing.version ?? 0) + 1;
    const updated: Service = {
      ...existing,
      ...manifest,
      version: nextVersion,
      updatedAt: now,
    };
    await this.mongo.services.replaceOne({ _id: existing._id }, updated);
    await this.recordVersion(
      existing._id,
      manifest.id,
      nextVersion,
      manifest,
      actor,
      now,
    );
    return { service: updated, created: false, versionBumped: true };
  }

  private async recordVersion(
    _id: string,
    serviceId: string,
    version: number,
    manifest: ServiceManifest,
    actor: string,
    ts: number,
  ): Promise<void> {
    const doc: ServiceVersionDoc = {
      _id: ulid(),
      serviceId,
      version,
      manifest,
      changedBy: actor,
      ts,
    };
    await this.mongo.versions.insertOne(doc);
  }

  async getById(id: string): Promise<Service | null> {
    return this.mongo.services.findOne({ id });
  }

  async list(): Promise<Service[]> {
    return this.mongo.services.find().sort({ tier: 1, name: 1 }).toArray();
  }

  async search(opts: ServiceSearchOptions): Promise<Service[]> {
    const filter: Record<string, unknown> = {};
    if (opts.tier) filter.tier = opts.tier;
    if (opts.lifecycle) filter.lifecycle = opts.lifecycle;
    if (opts.team) filter["owner.team"] = opts.team;
    if (opts.tag) filter.tags = opts.tag;
    if (opts.query) {
      const q = escapeRegExp(opts.query);
      filter.$or = [
        { id: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    }
    const limit = Math.min(opts.limit ?? 50, 200);
    return this.mongo.services
      .find(filter)
      .sort({ tier: 1, name: 1 })
      .limit(limit)
      .toArray();
  }

  async listVersions(serviceId: string): Promise<ServiceVersionDoc[]> {
    return this.mongo.versions
      .find({ serviceId })
      .sort({ version: -1 })
      .limit(50)
      .toArray();
  }

  async remove(id: string): Promise<boolean> {
    const r = await this.mongo.services.deleteOne({ id });
    await this.mongo.versions.deleteMany({ serviceId: id });
    return r.deletedCount > 0;
  }
}

function manifestChanged(a: Service, b: ServiceManifest): boolean {
  const stripA: ServiceManifest = {
    id: a.id,
    name: a.name,
    description: a.description,
    owner: a.owner,
    tier: a.tier,
    lifecycle: a.lifecycle,
    baseUrl: a.baseUrl,
    healthUrl: a.healthUrl,
    openapiUrl: a.openapiUrl,
    tags: a.tags,
    links: a.links,
    dependencies: a.dependencies,
  };
  return JSON.stringify(stripA) !== JSON.stringify(b);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
