using ExhibitionLeads.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Stall> Stalls => Set<Stall>();
    public DbSet<Exhibition> Exhibitions => Set<Exhibition>();
    public DbSet<SmtpConfig> SmtpConfigs => Set<SmtpConfig>();
    public DbSet<NotificationConfig> NotificationConfigs => Set<NotificationConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Exhibition>(entity =>
        {
            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.Entity<Lead>(entity =>
        {
            entity.Property(l => l.Budget).HasPrecision(18, 2);
            entity.HasIndex(e => e.LeadNumber).IsUnique();
            entity.HasIndex(e => e.Phone);
            entity.HasIndex(e => e.Email);
            entity.HasIndex(e => e.ExhibitionId);
            entity.HasIndex(e => e.StallId);
            entity.HasIndex(e => e.RepId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Email);
            entity.HasIndex(u => u.AssignedStallId);
        });

        modelBuilder.Entity<Stall>(entity =>
        {
            entity.HasIndex(s => s.Code).IsUnique();
            entity.HasIndex(s => s.OwnerId);
            entity.HasIndex(s => s.ExhibitionId);
        });

        modelBuilder.Entity<SmtpConfig>(entity =>
        {
            entity.HasIndex(s => s.UserId);
        });
    }
}
