/** Shape and Bot API limits of telegram/profile.json; shared by the sync script and tests. */

export interface BotCommand {
  command: string;
  description: string;
}

export interface Profile {
  name: string;
  short_description: string;
  description: string;
  commands: BotCommand[];
}

const COMMAND = /^[a-z0-9_]{1,32}$/;

export function loadProfile(raw: unknown): Profile {
  const p = raw as Partial<Profile>;
  const problems: string[] = [];
  const text = (field: keyof Profile, max: number, min = 0) => {
    const v = p[field];
    if (typeof v !== "string" || v.length < min || v.length > max) problems.push(`${field}: ${min}–${max} characters`);
  };
  text("name", 64, 1);
  text("short_description", 120);
  text("description", 512);
  if (!Array.isArray(p.commands) || p.commands.length > 100) problems.push("commands: up to 100 entries");
  for (const c of p.commands ?? []) {
    if (!COMMAND.test(c.command)) problems.push(`command "${c.command}": lowercase letters, digits, _; 1–32`);
    if (typeof c.description !== "string" || c.description.length < 1 || c.description.length > 256)
      problems.push(`command "${c.command}": description 1–256 characters`);
  }
  if (problems.length) throw new Error(`telegram/profile.json is invalid:\n- ${problems.join("\n- ")}`);
  return {
    name: p.name,
    short_description: p.short_description,
    description: p.description,
    commands: p.commands,
  } as Profile;
}
